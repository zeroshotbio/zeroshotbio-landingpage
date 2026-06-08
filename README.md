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

A "video-game" wizard for naming single-cell clusters cluster by cluster, across
multiple zebrafish atlases. A human plays referee (Kasparov's human–AI-hybrid
thesis): the AI surfaces grounded evidence and proposes an `(identity, state)`
call; you accept, relabel, or dig deeper. It can also **run the whole loop
itself** (auto-pilot), and — where the source atlas ships published cell-type
labels — **score its de-novo calls against that ground truth** afterward. Built
natively in Next.js (`src/app/daniotype_kasperov/`), not an iframe bundle.

It folds in mechanics from the standalone `daniotype` descent (Darien's CTO
project): de-novo, evidence-grounded naming under **cite-discipline**, an
`identity × state` label at the **ontology tier the evidence supports**,
**require-evidence-to-name → abstain/roll-up**, and **multi-proposer consensus** —
all inside the 3-personality chat UX.

**Flow:** **dataset picker** → intro → global UMAP → **"View clusters"** (colours
every cluster, one unified grid with a confidence heatmap + ✓-validated marks) →
click a cluster → **3-personality primer** (pixel-art cards; once per page load) →
the cluster chat screen. Or hit **🤖 Activate AutoPilot Cluster Labeller** to run
the whole loop headlessly (see *Auto-pilot*), then **🎯 Score vs ground truth** (see
*Ground-truth scorecard*).

### Datasets — the picker

The entry screen chooses which atlas the wizard runs on. Each dataset is a
self-contained asset family under `public/daniotype_kasperov/` selected by a
`datasetId`; runs persist under per-dataset `localStorage` keys so they never
collide. A "✓ ground truth" badge marks datasets with published labels to score
against.

| Dataset | Cells | Clusters | Ground truth | Status |
|---|---|---|---|---|
| **MiniFin** | 94,616 (Parse Evercode, 48 hpf) | 47 Leiden | — | ready |
| **ZSCAPE** | 250k de-novo sample of the 3,231,733-cell Saunders atlas | 55 de-novo | germ_layer / tissue / cell_type_broad / cell_type_sub | ready |
| **ChemFish** | 2.1M (Barkan et al.) | — | `cell_type` (~348) | soon (needs clustering) |
| **MegaFin** | 2.1M (Parse Evercode) | — | — (kNN-projected only) | soon (not sequenced) |

### World map

The pre-reveal screen shows the raw UMAP; **"View clusters"** colours the de-novo
clustering. For a **sampled** dataset (ZSCAPE) the header explains that the
250,000 cells are a *representative random sample of the full 3.2M-cell atlas*
spanning all conditions (perturbed + control) — not a biological subset — drawn
so de-novo clustering stays interactive, and that **we re-cluster from scratch
with the authors' labels held out** so they can serve as a benchmark. MiniFin
(the whole 94.6k) shows no sampling note.

A **single cluster grid** doubles as the navigator and the run summary: every
cluster as a card with its colour dot, our cell-type label (or muted "not yet
labelled"), a **confidence % badge heat-tinted red→green**, and a **✓ when the
identity is validated**. Clicking a card opens that cluster's full record.

The clustering itself is computed in `scripts/build_zscape_asset.py` (per
dataset): de-novo Leiden on a subsample, then **silhouette-gated recursive
sub-Leiden** (a coarse cluster is split only when the split clears a silhouette
floor + min-leaf size — the daniotype "sub-cluster large clusters" mechanic).
Published labels are computed per cluster (majority + purity at each tier) and
written to a **separate `groundtruth.json` that is never sent to the agent**, so
the labeller can't peek at the answer.

**Cluster screen layout:** a focused-cluster UMAP on the left with three
draggable + resizable HUD panels floating over it (**World Map**, **Top Markers**,
live **Confidence**), a draggable splitter, and the chat panel on the right
(50/50 at start). Panels auto-stack down the left edge and reflow — Top Markers
and Confidence auto-grow to fit content and push the others down — until you drag
one (then layout is manual); the last-interacted panel rises in z-order.

### One model, three personalities — Reasoner-orchestrated

`/api/kasperov_agent` (SSE) is backed by **OpenAI `gpt-5-mini`** (Responses API;
`OPENAI_API_KEY` in Vercel env, model override `KASPEROV_OPENAI_MODEL`). Colour
means exactly one thing in the chat — **which personality is speaking**
(🟢 **Researcher** / 🟡 **Archivist** / 🔵 **Reasoner**); everything else (markers,
bars, confidence, "added" confirmations, user turns) is greyscale.

- **Reasoner** — your main partner. Generalist synthesis, no tools; reads the
  evidence, judges when you're *done*, and hands the other two ready-to-send
  prompts. Never proposes lab/bench work.
- **Researcher** — web search restricted to ZFIN/ZFA/GO/NCBI/UniProt; cites records.
- **Archivist** — answers **only** from MiniFin via the `query_minifin` tool (below); never web.

**The chat is Reasoner-led, but everything is reachable.** The footer has three
always-available, labelled, colour-coded, pixel-art input lines — *Ask the
Reasoner / Researcher / Archivist* — and the line you type in **forces** that
personality (so a name mentioned in passing can't misroute you). Lean on the
Reasoner as your partner; it also offers one-click prompts that dispatch the
other two.

**Routing (`classifyMode`)**, in order: a message starting with `Researcher:` /
`Archivist:` / `Reasoner:` **forces** that one → a prompt-crafting request goes to
the Reasoner → the auto first identity pass is the Researcher → strong intent
verbs → keyword cues. The labelled input lines set the mode explicitly, bypassing
heuristics.

**Chat affordances** (all rendered *inside* the speaker's colour-bordered bubble):

- "➕ Add N insights to Top Markers" (from a hidden ` kasperov-markers ` block).
- "▶ Send to the Researcher/Archivist" dispatch buttons (from a ` kasperov-dispatch ` block).
- "▲/▼ Promote X to UP/DOWN-regulated" (from a ` kasperov-promote ` block).
- "✓ Accept identity: \<label\>" (from a ` kasperov-conclude ` block — the Reasoner's settled `(identity, state, tier)` call). When require-evidence fails it instead reads **"⤴ Accept (abstain/roll-up)"** at the deepest defensible tier (see *Daniotype mechanics*).
- "🧠 Ask Reasoner to Summarize and Suggest Next Steps" at the end of every non-Reasoner response.
- "▶ Yes — just run it and show everything" — a safety net that appears only when a specialist *defers* (asks you to choose), re-forcing that personality to fetch and report it all.
- Researcher answers render as `**gene** — finding [record]` lines with a small source chip (ZFIN/ZFA/GO/…); the **Verdict** is pulled into a personality-coloured callout with a greyscale confidence chip.

All control blocks parse whether the model emits them **fenced or bare**, and are stripped from the visible text.

### HUD panels

- **Top Markers** — real top-8 up- and (computed) down-regulated markers with
  log2FC bars + %in/%out. Chat-contributed evidence attaches **inline** under the
  matching gene; a discussed gene with a direction (auto by sign of log2FC, or via
  a Reasoner *promote*) **floats up** into the UP/DOWN list; genes with no
  direction sit in "✦ also discussed".
- **Confidence** — appears once there's a conversation. A live **granular** score
  (one decimal, e.g. `65.4%`) that **scrolls smoothly** toward each new value with
  ease-in-out, the bar gliding in sync, plus a fresh **≤100-word highest-level
  summary** (strongest support + main uncertainty) from `/api/kasperov_confidence`.
  Refreshes after **every turn** and **whenever evidence is added to Top Markers**.
  Greyscale.
- Top Markers & Confidence also grow **wider** (not just taller) as they gather
  content, until you drag a panel (then layout is fully manual).
- **World Map** — the whole atlas with a focus box on the active cluster.

### Behavioural guardrails (prompt-engineered)

- **Archivist — no fabrication.** Every number must come from a `query_minifin`
  call *this turn*; never reproduce remembered values, estimate "plausible" stats,
  or claim "I can't query". For a stats/p-value/mean question it uses one
  **`fullstats`** call. Cite-discipline: only the cluster's real markers count.
- **Reasoner — knows when it's done.** Doesn't re-dispatch already-answered
  queries; declares the call settled when evidence has converged; answers
  "are we done?" directly; only emits dispatch buttons for genuinely new queries.
- **Researcher** — narrow follow-ups (map a locus, find a synonym) get a specific
  answer, not a re-run of the full identity verdict.

### Daniotype mechanics (label quality)

Folded into the 3-personality loop to harden the calls — the headline lift over a
bare "LLM names the cluster" baseline:

- **`identity × state × tier` conclude.** The Reasoner's settled call is
  `{identity, tier, state, cited_markers, decision, confidence}`, not a flat
  label. `state ∈ {progenitor, cycling, quiescent, mature, stress, none}` applies
  only at the cell-type tier; coarser tiers carry identity only. Renders as
  `identity · state` (e.g. *hematopoietic progenitor · cycling*).
- **Require-evidence-to-name — enforced, not just prompted.**
  `enforceCiteDiscipline` (client) checks that `cited_markers` are actually drawn
  from *this cluster's* DEGs (its `degsUp` or genes promoted into the panel). A
  confident `"assign"` with no grounded marker is **downgraded to an abstention
  that rolls up to the deepest defensible tier** — shown as
  *"⤴ Accept (abstain/roll-up): \<tier\>"*. Applied on both the manual Accept
  button and the auto-pilot accept.
- **K = 2 consensus in auto-pilot.** Each cluster gets two *independent*
  Researcher proposers — a default read and an alternative-hypothesis read, each
  from a fresh context so they can't anchor on each other — and the Reasoner
  **adjudicates the two** before concluding. Costs one extra research call per
  cluster.
- **Back-compatible.** `splitConclude` still parses the legacy flat
  `{label, confidence, done}` block.

> **Deferred:** real *structured* ZFIN/ZFA/GO tools (an `expression_lookup`
> against the curated ZFIN wildtype-expression table + a ZFA `develops_from`
> lineage walker) — an ontology-data-layer build rather than a prompt change. The
> Researcher still grounds via restricted web search over those domains today.

### `query_minifin` tool — kinds & data sources

| Kind | Returns | Backed by |
|---|---|---|
| `gene` / `genes` | one-vs-rest log2FC + %in/%out | static per-cluster profile |
| `top` | top-N up/down markers | static profile |
| `search` | substring gene match | static profile |
| `across` | one gene's mean + %expr in **every** cluster + specificity rank | static gene × cluster matrix |
| `specificity` | cross-cluster specificity summary (active mean/pct, rank, top clusters) for a gene **list** | static matrix |
| `pvalues` | BH-adjusted one-vs-rest p-values (+log2FC, %in/out) | **live microservice** |
| `coexpress` | cell-level fraction co-expressing **all** listed genes | **live microservice** |
| `fullstats` | log2FC + %in/out + **p-value + mean expression** for a gene list, **in one call** | matrix + live service merged |

The archivist tool is **per-dataset**: the agent route picks the archivist
extract + static-asset base from the request's `datasetId`. Static files live
under `public/daniotype_kasperov/archivist/` (MiniFin: 24,252 genes × 47
clusters) and `public/daniotype_kasperov/datasets/<id>/archivist/` (ZSCAPE:
16,718 genes × 55 clusters) — per-cluster `<id>.json` profiles + `gene_matrix.json`,
derived from each **h5ad** by the build scripts below. The live p-value /
co-expression microservice is **MiniFin-only**; other datasets answer from the
static archivist (the `pvalues`/`coexpress`/`fullstats` kinds degrade gracefully).

> **Security posture (critical):** the raw **`.h5ad` is NEVER served** — it lives
> only on the EC2 box, read solely by the microservice, which returns only
> aggregated answers (no raw matrix, no cell-level dump beyond a co-expression
> fraction). The static CDN files are aggregated, derived stats on an unlisted
> path. The live endpoint is **token-gated** (401 without it) over HTTPS.

### The MiniFin query microservice — LIVE

`backend/minifin_query_api/` — FastAPI; loads the h5ad once (~94.6k cells,
~6 GB, ~30 s startup), binds `127.0.0.1:5007`. `GET /health`; `POST /query`
(header `x-api-token`) with `{kind: "pvalues"|"coexpress", cluster, genes}`.
Computes adjusted p-values (Welch t-test on log-normalised expression,
Benjamini-Hochberg across the transcriptome; per-cluster results cached) and
cell-level co-expression. Responds in 0.01–0.7 s. Full deploy steps in its README.

Currently deployed on the EC2 box:

- systemd unit **`minifin_query`** (`enabled`; survives reboot). Manage with
  `sudo systemctl status|restart minifin_query`, `sudo journalctl -u minifin_query -f`.
- Exposed via nginx at **`https://zscape.zeroshot.bio/minifin/`** (a
  `location /minifin/` added to `zscape_chat.conf` → `127.0.0.1:5007`).
- Token only in the systemd unit (`MINIFIN_API_TOKEN`), not the repo.
- **Vercel env (Production, set):** `MINIFIN_SERVICE_URL=https://zscape.zeroshot.bio/minifin`,
  `MINIFIN_SERVICE_TOKEN=<same token>`. When unset, `pvalues`/`coexpress`/`fullstats`
  degrade gracefully and everything else still works from the static files.

### Hidden control blocks

The agent embeds blocks (fenced **or** bare) that the client parses and **strips
from view**, turning them into buttons:

- ` kasperov-markers ` — `[{g, l2fc, p1, p2, note}]` → "Add to Top Markers".
- ` kasperov-dispatch ` — `[{to:"researcher"|"archivist", prompt}]` → "Send to …".
- ` kasperov-promote ` — `[{gene, dir:"up"|"down", note}]` → "Promote to UP/DOWN".
- ` kasperov-conclude ` — `{identity, tier, state, cited_markers, decision,
  confidence, done}` (legacy `{label, …}` still parses) → the Reasoner's settled
  call; surfaces "✓ Accept identity" (or "⤴ Accept (abstain/roll-up)" when
  cite-discipline downgrades it) and drives auto-pilot's accept-and-advance.

### Auto-pilot — the system runs itself

**🤖 "Activate AutoPilot Cluster Labeller"** (World Map) drives the whole loop with
no human in the seat. Per un-**labelled** cluster it: runs **two independent
identity proposers** (Researcher; default + alternative-hypothesis) → asks the
Reasoner to **reconcile** them and summarise + decide → fires the Reasoner's
`kasperov-dispatch` prompts to the Researcher/Archivist → auto-adds their
`kasperov-markers` → and when the Reasoner emits a `kasperov-conclude` block,
**enforces require-evidence** (roll up to abstain if ungrounded), records the
label, **accepts, and advances**. Bounded to `AUTO_MAX_ROUNDS` (4) Reasoner
rounds/cluster (best-effort accept if it maxes out) so it can't loop forever.

**Resilience:** each stream has a hard timeout + one retry, so a hung/failed
request can't stall the sweep; a cluster that still errors is recorded and
skipped, then surfaced in a post-run banner with a **↻ Retry these**. "Done" is
keyed off **having a label**, not merely being validated (a cluster can be
validated by hand without a label), so the sweep auto-skips already-labelled
clusters and resumes cleanly. The view follows each cluster live; a top-bar badge
shows progress with **■ Stop**; inputs are disabled while it runs; the routing
animation is skipped for speed.

Implementation note: `streamAgent(cluster, msgs, mode, fast)` returns the final
message array, so the loop chains calls headlessly while the UI mirrors the active
cluster. State (transcripts/markers/confidence/labels) lives in the **top-level
component** — not `ClusterStage`, which unmounts on the map — so navigating
map↔cluster preserves every cluster's record.

### Ground-truth scorecard

For a dataset with published labels, **🎯 Score vs ground truth** (World Map, shown
once ≥1 cluster is labelled) opens a scorecard that grades our de-novo calls
against the authors' labels at **all four ontology tiers** (germ_layer → tissue →
cell_type_broad → cell_type_sub).

- **`/api/kasperov_score`** — an LLM judge (`gpt-5-mini`, strict `json_schema`)
  decides, per tier, whether our label is **semantically** the same biological
  entity as the reference — synonyms / ontology / lineage equivalence, **numeric
  sub-suffixes ignored** ("periderm 10" → "periderm"), **not** string match. It
  enforces **depth discipline**: a correct-but-coarser label scores ✗ at the finer
  tier, so abstain/roll-up calls produce the honest depth gradient instead of
  inflated fine-tier credit.
- **UI** — four depth-stratified agreement bars (heat-tinted red→green,
  `matched/total`) + a per-cluster table of ours-vs-theirs with ✓/✗ and the
  judge's note on hover. Scoring batches across clusters with concurrency + a
  progress readout; the result is cached per label-set in `localStorage` with a
  **↻ Re-run** control. The reference (`groundtruth.json`) is loaded only here —
  never by the labelling agent.

### Run summary, reset & export (World Map)

- **Cluster grid** — the unified navigator/run-summary grid: every cluster with
  its label, confidence heatmap badge, and ✓-validated mark; click to reopen its
  full record.
- **↺ Reset run** — clears validations, labels, and saved history (confirm-gated).
- **⬇ Export results (JSON)** — the whole run: per-cluster `{finalLabel,
  confidence, addedMarkers, transcript, validated}`.

### Endpoints

| Route | Purpose |
|---|---|
| `/api/kasperov_agent` (SSE) | the 3-personality agent + per-dataset archivist tool loop |
| `/api/kasperov_confidence` | live confidence score + ≤100-word summary |
| `/api/kasperov_score` | ground-truth scorecard — per-tier semantic agreement |
| `https://zscape.zeroshot.bio/minifin/query` | live p-values / co-expression (token-gated, MiniFin) |

### Operational notes

- Runs under the **60 s Vercel hobby `maxDuration`** (aborts at ~56 s). The
  Archivist runs at minimal reasoning effort, batches gene lists into one call
  (`fullstats`/`genes`/`specificity`), caps tool rounds (then forces a written
  answer), and retries once on a transient upstream 5xx. The microservice is
  sub-second, not the bottleneck; a rare "(time limit)" is an upstream OpenAI
  latency blip — just re-ask.
- **Persistence (POC).** Keyed **per dataset**: validated set + labels under
  `daniotype_kasperov_v3:<id>`; the full run (transcripts + markers + confidence)
  under `daniotype_kasperov_results:<id>` (debounced, restored on load, falls back
  to markers+confidence on quota overflow); the scorecard result under
  `daniotype_kasperov_score:<id>`. So each dataset's run is independent and
  survives reload. (The primer is intentionally **not** persisted — once per load.)

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
