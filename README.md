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

A "video-game" wizard for judging the MiniFin atlas cluster by cluster. A human
plays referee (Kasparov's human–AI-hybrid thesis): the AI surfaces grounded
evidence; you make the call. Built natively in Next.js
(`src/app/daniotype_kasperov/`), not an iframe bundle.

**Flow:** intro → global UMAP of the whole atlas → **"View Leiden clusters"**
(colours all 47, shown at once as a grid — no scroll) → click a cluster →
**3-personality primer** (pixel-art cards; shows once per page load) → the cluster
chat screen. Or hit **🤖 Go through each cluster on your own** to let it run the
whole loop itself (see *Auto-pilot* below).

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
- "✓ Accept identity: \<label\>" (from a ` kasperov-conclude ` block — the Reasoner's settled call).
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

Static files live in `public/daniotype_kasperov/archivist/` (per-cluster
`<id>.json` profiles + `gene_matrix.json`, 24,252 genes × 47 clusters). All
derived from the MiniFin **h5ad** by `scripts/extract_minifin_umap.py` and
`scripts/compute_minifin_archivist.py` (run with `/data/.venv/bin/python`).

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
- ` kasperov-conclude ` — `{label, confidence, done}` → the Reasoner's settled
  identity; surfaces "✓ Accept identity" and drives auto-pilot's accept-and-advance.

### Auto-pilot — the system runs itself

**🤖 "Go through each cluster on your own"** (World Map) drives the whole loop with
no human in the seat. Per un-validated cluster it: runs the identity pass
(Researcher) → repeatedly asks the Reasoner to summarise + decide → fires the
Reasoner's `kasperov-dispatch` prompts to the Researcher/Archivist → auto-adds
their `kasperov-markers` → and when the Reasoner emits a `kasperov-conclude`
block, records the label, **accepts the identity, and advances**. Bounded to
`AUTO_MAX_ROUNDS` (4) Reasoner rounds/cluster (best-effort accept if it maxes out)
so it can't loop forever. The view follows each cluster live; a top-bar badge
shows progress with a **■ Stop**; inputs are disabled while it runs; the routing
animation is skipped for speed; already-validated clusters are skipped (resumable).

Implementation note: `streamAgent(cluster, msgs, mode, fast)` returns the final
message array, so the loop chains calls headlessly while the UI mirrors the active
cluster. State (transcripts/markers/confidence/labels) lives in the **top-level
component** — not `ClusterStage`, which unmounts on the map — so navigating
map↔cluster preserves every cluster's record.

### Run summary, reset & export (World Map)

- **Run summary** — each labelled cluster with its cell-type identity
  (≤15 words) next to the cluster name; click to reopen its full record.
- **↺ Reset run** — clears validations, labels, and saved history (confirm-gated).
- **⬇ Export results (JSON)** — the whole run: per-cluster `{finalLabel,
  confidence, addedMarkers, transcript, validated}`.

### Endpoints

| Route | Purpose |
|---|---|
| `/api/kasperov_agent` (SSE) | the 3-personality agent + `query_minifin` tool loop |
| `/api/kasperov_confidence` | live confidence score + ≤100-word summary |
| `https://zscape.zeroshot.bio/minifin/query` | live p-values / co-expression (token-gated) |

### Operational notes

- Runs under the **60 s Vercel hobby `maxDuration`** (aborts at ~56 s). The
  Archivist runs at minimal reasoning effort, batches gene lists into one call
  (`fullstats`/`genes`/`specificity`), caps tool rounds (then forces a written
  answer), and retries once on a transient upstream 5xx. The microservice is
  sub-second, not the bottleneck; a rare "(time limit)" is an upstream OpenAI
  latency blip — just re-ask.
- **Persistence (POC).** Validated set + cell-type labels persist to
  `localStorage` (`daniotype_kasperov_v3`). The full run — transcripts + added
  markers + confidence — is persisted (debounced) to `daniotype_kasperov_results`
  and restored on load, so revisiting any cluster shows its record and the run
  survives reload. On storage-quota overflow it falls back to markers+confidence
  only. (The primer is intentionally **not** persisted — it shows once per load.)

### Reproduce the data assets

```bash
/data/.venv/bin/python scripts/extract_minifin_umap.py        # public UMAP + markers
/data/.venv/bin/python scripts/compute_minifin_archivist.py   # per-cluster profiles + gene_matrix
```

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
