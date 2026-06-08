# Zeroshot Bio — Web App

*Next.js 15 · React 18 · Tailwind CSS · D3 · Flask · Jina v3 Ridge · Claude Sonnet 4.6 · Vercel*

---

## What's in this repo

The Zeroshot Bio web app: a marketing landing page plus a small family of
single-cell tools. Two products are live today — the **ZSCAPE chat** and the
**MiniFin annotation wizard**.

| Route | What it is | Stack |
|---|---|---|
| `/` | Marketing landing page | Next.js + Tailwind |
| `/zscape_chat` | ZSCAPE perturbation chat | Next.js front-end → Flask backend |
| `/minifin_annotation_wizard` | Expert wizard for reviewing MiniFin single-cell clusters | Next.js shell → self-contained static bundle + DynamoDB state |

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

## daniotype · kasperov — human-in-the-loop cell-type labelling

`https://www.zeroshot.bio/daniotype_kasperov`

A "video-game" wizard for judging the MiniFin atlas cluster by cluster. Flow:
**intro → global UMAP → "View Leiden clusters" → click a cluster → (one-time
3-personality primer) → chat.** Each focused-cluster screen has draggable /
resizable HUD panels (World Map, Top Markers, live Confidence) and a chat panel.
Built natively in Next.js (`src/app/daniotype_kasperov/`), not an iframe bundle.

### The agent — one model, three routed personalities

`/api/kasperov_agent` (SSE) is backed by **OpenAI `gpt-5-mini`** (Responses API,
key in Vercel env `OPENAI_API_KEY`; override model with `KASPEROV_OPENAI_MODEL`).
Every question is routed to one of three personalities; colour = personality
everywhere in the chat (🟢 Researcher / 🟡 Archivist / 🔵 Reasoner), everything
else greyscale. Name one ("Archivist, …") to force it.

- **Researcher** — web search restricted to ZFIN/ZFA/GO/NCBI/UniProt; cites records.
- **Archivist** — answers **only** from MiniFin via a `query_minifin` tool (below); never web.
- **Reasoner** — generalist synthesis, no tools; emits ready-to-send dispatch
  prompts (→ "Send to Researcher/Archivist" buttons).

A separate `/api/kasperov_confidence` returns a live 0–100 confidence + ≤40-word
rationale after each turn.

### Archivist data architecture (important)

The Archivist's `query_minifin` tool answers progressively heavier queries from
two sources:

| Source | Served from | Kinds |
|---|---|---|
| **Static precomputed** (aggregated, public on the CDN) | `public/daniotype_kasperov/archivist/` | `gene`, `genes`, `top`, `search` (per-cluster profiles); `across`, `specificity` (gene × cluster matrix, 24,252 genes × 47 clusters) |
| **Live microservice** (token-gated) | EC2 `minifin_query` service | `pvalues` (BH-adjusted one-vs-rest), `coexpress` (cell-level co-expression) |

Both are derived from the MiniFin **h5ad** by `scripts/extract_minifin_umap.py`
and `scripts/compute_minifin_archivist.py` (run with `/data/.venv/bin/python`).

> **Security posture (critical):** the raw **`.h5ad` is NEVER served** — it lives
> only on the EC2 box and is read solely by the microservice, which returns only
> aggregated answers. The static CDN files are aggregated, derived stats on an
> unlisted path. The microservice endpoint is **token-gated** (401 without it) and
> reached over HTTPS.

### The MiniFin query microservice

`backend/minifin_query_api/` — FastAPI; loads the h5ad once (~94.6k cells,
~6 GB, ~30 s startup), binds `127.0.0.1:5007`. Endpoints: `GET /health`,
`POST /query` (header `x-api-token`). Computes **adjusted p-values** (Welch
t-test on log-normalised expression, Benjamini-Hochberg across the
transcriptome; per-cluster results cached) and **cell-level co-expression**
(fraction of a cluster's cells expressing all listed genes). Responds in
0.01–0.7 s. See its README for the full deploy.

**Live deployment (already set up on the EC2):**

- systemd unit `minifin_query` (`enabled` — survives reboot). Manage with
  `sudo systemctl status|restart minifin_query`, `sudo journalctl -u minifin_query -f`.
- Exposed via nginx as `https://zscape.zeroshot.bio/minifin/` (a `location /minifin/`
  added to the existing `zscape_chat.conf` server block → `127.0.0.1:5007`).
- Token lives only in the systemd unit (`MINIFIN_API_TOKEN`), not in the repo.
- **Vercel env (Production):** `MINIFIN_SERVICE_URL=https://zscape.zeroshot.bio/minifin`
  and `MINIFIN_SERVICE_TOKEN=<same token>`. When unset, `pvalues`/`coexpress`
  degrade gracefully and the rest still works from static files.

### Operational notes

- The agent runs under the **60 s Vercel hobby `maxDuration`** (aborts at ~56 s).
  The Archivist runs at minimal reasoning effort, batches multi-gene lookups into
  one tool call, caps tool rounds (then forces a written answer). The microservice
  is not the bottleneck (sub-second); a rare "(time limit)" is an upstream OpenAI
  latency blip — just re-ask.
- Verdicts persist to `localStorage` (POC); the export shape mirrors the
  `/api/minifin_annotation` `{lastIndex, decisions}` contract for later DynamoDB
  wiring.

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
