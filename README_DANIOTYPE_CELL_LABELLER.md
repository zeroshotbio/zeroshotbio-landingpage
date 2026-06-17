# DanioType · Kasperov — Cell-Type Labelling Workflow

The canonical guide to the human-in-the-loop zebrafish cell-type labelling tool that lives at
**`/daniotype_kasperov`** (production: `https://www.zeroshot.bio/daniotype_kasperov`, Basic-Auth gated).

Named for Kasparov's thesis that the strongest systems are human–AI hybrids: a three-personality
agent serves grounded, cited evidence for every single-cell cluster, and a human curator (or the
auto-pilot) walks the atlas cluster by cluster, accepting / relabelling / abstaining on each call.

> **Scope.** This README is dedicated to the cell-labeller. For the wider site see the root
> `README.md`. For the worker, see `backend/daniotype_autopilot_api/README.md`. For the clustering
> methodology writeup see `src/app/daniotype_kasperov/CLUSTERING_REPORT.md`.

> **Spelling.** This file uses **`kasperov`** throughout to match the live code, env-var, and URL
> identifiers (`/daniotype_kasperov`, `/api/kasperov_*`, `KASPEROV_*`). The `kasparov` rename is a
> separate pending pass that will update this file along with the code.

> **Status — post-cutover (2026-06-17).** The backend now runs **on this box**, reached at
> **`https://daniotype.zeroshot.bio`**. The previous `zscape.zeroshot.bio` edge host is being
> **retired**. Everything below is written from the live on-box configuration.

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
contamination where ChemFish was served MiniFin stats. If the guard fails it **halts the run
rather than spending blind** (see Gotchas).

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
| `megafin` | Manual MegaFin Part 1 | — | — | Lawson `.h5ad` build (de-novo res 2.0, 84 clusters) |

> The `zscape_v2` "coming soon" stub was **removed** at the cutover (commit `fc15f2a`) — it no
> longer lists or fetches.

GT datasets hold the authors' published labels out and score our de-novo names against them.
The "native tiers" map (`Scorecard.tsx → NATIVE_TIERS_BY_DATASET`) sets how many tiers each
GT dataset scores (4 for ZSCAPE, 2 for ChemFish/DanioCell).

**Stats service datasets (`:5007`).** The co-expression service eager-loads **9** dataset keys —
the six above **plus** three staged native-schema re-bases used by the native benchmark work:
`minifin, megafin, megafin_parse, zscape, chemfish, daniocell, zscape_native, chemfish_native,
daniocell_native`. Each key's source `.h5ad` / cluster column / symbol map is wired by a systemd
drop-in (see §4.3). Keep each `*_CLUSTER_COL` in lockstep with the **deployed** `daniotype_data/`
atlas assets, or live stats land on the wrong cluster IDs.

---

## 4. Infrastructure (post-cutover, live)

### 4.1 Request flow

```
Browser ── https://www.zeroshot.bio/daniotype_kasperov  (Next.js client, Basic-Auth gated)
  │
  ├─ /api/kasperov_agent       → OpenAI Responses API (the 3 personalities)
  │     ├─ Archivist  ─────────────────────────────┐ live stats
  │     └─ archivist extracts / umap (static) ──────┤
  ├─ /api/kasperov_confidence  → per-tier scoring   │
  ├─ /api/kasperov_score       → the GT judge       │
  ├─ /api/kasperov_proxy       → cited-page proxy    │
  ├─ /api/kasperov_runs[/all]  → run store ──────────┤ (proxy to the worker)
  └─ /api/kasperov_autopilot   → start/poll a run ───┤
                                                     ▼
                       ┌──────────────────────────────────────────────────────┐
                       │  https://daniotype.zeroshot.bio   (this box, nginx 443) │
                       │   ├─ /minifin/        → 127.0.0.1:5007  (stats)         │
                       │   ├─ /daniotype_data/ → static assets (this checkout)   │
                       │   └─ /autopilot/      → 127.0.0.1:5008  (worker + runs) │
                       └──────────────────────────────────────────────────────┘
```

The frontend is on Vercel; **all three backend surfaces now resolve to this single box** via
`daniotype.zeroshot.bio`. The old `zscape.zeroshot.bio` edge host is being retired.

### 4.2 The box

| | |
|---|---|
| Public name | **`daniotype.zeroshot.bio`** → `44.226.227.3` |
| Instance id | `i-0a6f465ee9f785b9d` |
| Hostname | `ip-172-31-60-9` (`ip-172-31-60-9.us-west-2.compute.internal`) |
| Region | `us-west-2` |
| Type | `r6g.2xlarge` (ARM Graviton, 8 vCPU) |
| RAM | 62 GiB total (~43 GiB resident once `:5007` is warm) |
| Data volume | `/data` (EBS) — repo checkout, venv, run store, bench/atlas assets |

### 4.3 The two services (systemd)

**1. `minifin_query.service` — MiniFin / co-expression stats — port `:5007`**
The Archivist's live-numbers backend **and** the autopilot grounding target.

- Unit: `/etc/systemd/system/minifin_query.service`
- Drop-ins: `/etc/systemd/system/minifin_query.service.d/*.conf` — one per dataset key
  (`minifin.conf`, `zscape.conf`, `chemfish.conf`, `daniocell.conf`, `megafin.conf`,
  `megafin_parse.conf`, `native_rebase.conf`) wiring each `*_H5AD` / `*_ASSIGN` /
  `*_CLUSTER_COL` / `*_SYMBOL_MAP`.
- WorkingDirectory: `/data/zeroshotbio-landingpage/backend/minifin_query_api`
- ExecStart: `/data/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 5007`
- **Eager warm-up (~5.5 min).** `Type=simple`: the port binds immediately and a background thread
  loads **all 9 datasets resident** at startup. `GET /health` reports `warm:false` and
  `loaded:[]` until the load completes (then `warm:true`, `loaded` = 9, `resident_gb ≈ 43`).
  `/query` for a not-yet-loaded dataset fails during this window.

**2. `daniotype_autopilot.service` — persistent autopilot worker + run store — port `:5008`**
Drives the SAME labelling loop headlessly (calling the deployed `/api/*` endpoints) and owns the
run store.

- Unit: `/etc/systemd/system/daniotype_autopilot.service`
  (`AUTOPILOT_BASE_URL=https://www.zeroshot.bio`, `AUTOPILOT_RUNS_DIR=/data/daniotype_runs`)
- Drop-ins: `/etc/systemd/system/daniotype_autopilot.service.d/`
  - `asset.conf` → `AUTOPILOT_ASSET_DIR=/data/zeroshotbio-landingpage/daniotype_data`
  - `grounding_guard.conf` → `STATS_VERIFY_URL=http://127.0.0.1:5007`
  - `override.conf` → the tokens + Basic-Auth password (see §4.5)
- WorkingDirectory: `/data/zeroshotbio-landingpage/backend/daniotype_autopilot_api`
- ExecStart: `/data/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 5008`
- Restarts fast (no warm window).

### 4.4 Key paths

| What | Path |
|---|---|
| Python venv | `/data/.venv` (`/data/.venv/bin/uvicorn`) |
| Run store (EBS, outside repo) | `/data/daniotype_runs/<datasetId>/` |
| Atlas / wizard assets (served by nginx) | `/data/zeroshotbio-landingpage/daniotype_data/<dataset>/` |
| Bench `.h5ad` + label/map sidecars | `/data/scratch/bench/*.h5ad`, `*_labels.csv`, `*_canonical_map.csv` |
| MiniFin raw object | `/data/datasets/raw_datasets/MiniFin/minifin_filtered.h5ad` |

### 4.5 nginx + TLS

Site: `/etc/nginx/sites-available/daniotype.zeroshot.bio` (symlinked in `sites-enabled/`),
`server_name daniotype.zeroshot.bio`.

- **`location /minifin/`** → `proxy_pass http://127.0.0.1:5007/` (HTTP/1.1, `Host`/`X-Forwarded-*`
  set, `proxy_read_timeout 120s`). Request headers pass through untouched, so the hyphenated
  `x-api-token` reaches the service.
- **`location /autopilot/`** → `proxy_pass http://127.0.0.1:5008/` (same proxy settings).
- **`location /daniotype_data/`** → `alias /data/zeroshotbio-landingpage/daniotype_data/`
  (static). **CORS allow-list** via a `map $http_origin → $daniotype_cors_origin` that echoes back
  **only** `https://www.zeroshot.bio` or `https://zeroshot.bio` (empty otherwise) on `Vary:
  Origin`; **`OPTIONS` preflight** is answered `204` with the CORS method/header/max-age headers.
- `client_max_body_size 50m` for autopilot run/capture payloads.

**TLS** — Certbot (`--nginx`), Let's Encrypt, ECDSA key. Cert at
`/etc/letsencrypt/live/daniotype.zeroshot.bio/`, **valid to 2026-09-15**, `renew_before_expiry =
30 days`. Auto-renewal runs via the active `certbot.timer`. Plain **HTTP `:80` → 301 → HTTPS**.

### 4.6 Token topology (names only — no secret values)

There are **two** distinct service tokens (plus the Basic-Auth password). The **stats/grounding**
token is **shared by three holders** and they must stay byte-equal:

| Logical token | Vercel env var | `:5007` (minifin_query) | `:5008` (autopilot) |
|---|---|---|---|
| **Stats / grounding** (shared) | `MINIFIN_SERVICE_TOKEN` | `MINIFIN_API_TOKEN` | `STATS_VERIFY_TOKEN` |
| **Autopilot API** | `KASPEROV_AUTOPILOT_TOKEN` | — | `AUTOPILOT_API_TOKEN` |
| **Basic-Auth gate** (password) | `KASPEROV_BASIC_PASSWORD` | — | `KASPEROV_BASIC_PASSWORD` |

- The frontend Archivist (`/api/kasperov_agent`) calls `:5007 /query` with `MINIFIN_SERVICE_TOKEN`,
  which must equal `:5007`'s `MINIFIN_API_TOKEN`. The autopilot grounding guard calls the same
  `:5007 /query` with `:5008`'s `STATS_VERIFY_TOKEN` — hence all three copies must match.
  (`:5007` returns **401** on mismatch; the guard refuses to run if it can't authenticate.)
- The frontend run-store / autopilot proxies (`/api/kasperov_runs[/all]`, `/api/kasperov_autopilot`)
  call `:5008` with `KASPEROV_AUTOPILOT_TOKEN` = `:5008`'s `AUTOPILOT_API_TOKEN` (sent as
  `x-api-token`).
- `KASPEROV_BASIC_PASSWORD` gates the whole `/daniotype_kasperov` route in `src/middleware.ts`;
  the worker carries a matching copy (in `override.conf`). **Note:** at the time of writing the
  worker copy is the placeholder `PLACEHOLDER_SET_AT_CUTOVER` — set it to the real Vercel value if
  the worker needs to self-auth through the gate.

> On-box token values are read (never printed) with, e.g.:
> `sudo grep -oP '^Environment=MINIFIN_API_TOKEN=\K.*' /etc/systemd/system/minifin_query.service`
> and the autopilot tokens from `…/daniotype_autopilot.service.d/override.conf`.

### 4.7 Vercel env vars that point at the backend (names + host, set in Vercel — no values here)

Post-cutover these resolve at `https://daniotype.zeroshot.bio`:

| Vercel env var | Points at |
|---|---|
| `MINIFIN_SERVICE_URL` | `https://daniotype.zeroshot.bio/minifin` (stats service base) |
| `DANIOTYPE_ASSET_BASE` | `https://daniotype.zeroshot.bio/daniotype_data` (static assets) |
| `KASPEROV_AUTOPILOT_URL` | `https://daniotype.zeroshot.bio/autopilot` (worker base) |
| `MINIFIN_SERVICE_TOKEN` | shared stats/grounding token (see §4.6) |
| `KASPEROV_AUTOPILOT_TOKEN` | autopilot API token (see §4.6) |
| `KASPEROV_BASIC_PASSWORD` | route Basic-Auth password (see §4.6) |

Plus `OPENAI_API_KEY` (and optional `KASPEROV_OPENAI_MODEL`, `STATS_SERVICE_DATASETS`) which are
not backend-host-specific. **The browser asset base is hardcoded** in `KasperovClient.tsx`
(`ASSET_BASE = "https://daniotype.zeroshot.bio/daniotype_data"`); the server-side
`DANIOTYPE_ASSET_BASE` default in `route.ts` still reads `zscape.zeroshot.bio` and is expected to
be overridden by the Vercel env var above until that default is updated.

### 4.8 Deploy mechanics

- **Frontend** → **push to `main`** → Vercel auto-deploys production (non-`main` → preview URLs).
  The whole `/daniotype_kasperov` route + `/api/kasperov_*` sit behind **HTTP Basic Auth**.
- **Backend code** (`backend/minifin_query_api/app.py`, `backend/daniotype_autopilot_api/app.py`):
  **edit or `git pull` on the box**, then `sudo systemctl restart <service>`. A git push does
  **not** update either service.
- **Atlas / wizard assets** (`daniotype_data/`) are served **from this box's own repo checkout**,
  so a **`git pull` on the box makes new atlas assets live immediately** — no more opaque
  edge-host sync step. (If a new asset changes a dataset's cluster partition, also update the
  matching `:5007` drop-in `*_CLUSTER_COL` and restart `minifin_query`.)

---

## 5. Operating the backend

```bash
# Health
curl -s https://daniotype.zeroshot.bio/minifin/health         # {ok, warm, loaded[], resident_gb}
curl -s http://127.0.0.1:5008/health                          # {ok, active}
sudo systemctl status minifin_query daniotype_autopilot

# Restart  (edit app.py or git pull first)
sudo systemctl restart daniotype_autopilot                    # fast
sudo systemctl restart minifin_query                          # then WAIT ~5.5 min for warm

# Wait out the warm window
until curl -s http://127.0.0.1:5007/health | grep -q '"warm":true'; do sleep 5; done

# After editing any unit / drop-in
sudo systemctl daemon-reload && sudo systemctl restart <service>
```

---

## 6. The run store

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

## 7. Run JSON schema (`daniotype_kasperov_run/v1`)

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

## 8. File map (`src/app/daniotype_kasperov/`)

| File | Role |
|---|---|
| `page.tsx` | thin server wrapper → `KasperovClient` |
| `KasperovClient.tsx` | the wizard: dataset picker, stage machine, MapStage, ModelHarnessPicker, ClusterStage (chat), run list modal, save flow; **`ASSET_BASE`** (browser asset host) |
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

Backend: `backend/minifin_query_api/app.py` (`:5007` stats),
`backend/daniotype_autopilot_api/app.py` (`:5008` worker). Report: `scripts/completeness_report.ts`.

---

## 9. Develop & verify

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

## 10. Known caveats / open threads

- **`:5007` warm window.** After any `minifin_query` restart there is a **~5.5 min** eager
  warm-up; `/query` and the grounding guard fail until `GET :5007/health` reports `warm:true`
  (9 datasets loaded, ~43 GiB resident). Plan restarts pre-flip / off-peak.
- **Grounding guard halts on mismatch.** If `:5007` is serving the wrong dataset (or the shared
  token doesn't authenticate), the autopilot **stops rather than spending blind** — the fix for the
  historical `ba32de` ChemFish-served-MiniFin contamination. Keep each `:5007` drop-in
  `*_CLUSTER_COL` in lockstep with the deployed `daniotype_data/` assets.
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
- **Worker / stats restarts.** `?include=archived` / `/runs/all` (and any `app.py` change) require
  a `sudo systemctl restart` of the relevant service; a git push alone does not update the box's
  services.
- **Judge variance.** Re-scoring the same run can swing ~±2–3 pt; compare versions in one paired
  judge pass, not across stored numbers.
- **Basic-Auth password placeholder.** The worker's `KASPEROV_BASIC_PASSWORD` (override.conf) is
  currently `PLACEHOLDER_SET_AT_CUTOVER`; set it to the real Vercel value if the worker must
  authenticate through the gate.
- **`kasparov` rename pending.** Code/env/URLs still use `kasperov`; a later pass renames them and
  this file.

---

*Production frontend: `https://www.zeroshot.bio/daniotype_kasperov` (Basic-Auth gated, deploys from
`main`). Backend: `https://daniotype.zeroshot.bio` on `i-0a6f465ee9f785b9d` (this box). The old
`zscape.zeroshot.bio` edge host is being retired.*
