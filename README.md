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
