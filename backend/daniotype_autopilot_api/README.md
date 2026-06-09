# daniotype_kasperov persistent auto-pilot worker + run store

Two jobs, one small FastAPI service on the EC2 box:

1. **Persistent auto-pilot** — runs the AutoPilot Cluster Labeller server-side so
   a run survives the browser closing. It drives the *same* loop the client does,
   headlessly: per cluster it calls the **deployed Vercel endpoints**
   (`/api/kasperov_agent`, `/api/kasperov_score`), so the OpenAI secret stays on
   Vercel — this box holds none.
2. **Run store** — completed runs (server-driven *and* browser exports) are stored
   as JSON files on the **EC2 EBS volume** (`AUTOPILOT_RUNS_DIR`, default
   `/data/daniotype_runs`). **No S3 bucket needed.** The Vercel
   `/api/kasperov_runs` route proxies here for save / list / load.

## Endpoints (token-gated, `x-api-token`)

Auto-pilot: `POST /start {datasetId, model}` → `{runId}` · `GET /status/{runId}`
· `POST /abort/{runId}` · `GET /health`
(`phase`: `queued → loading → labelling → scoring → saving → done`).

Run store: `POST /runs <run JSON>` → `{runId}` · `GET /runs?dataset=<id>` →
`{runs:[…meta]}` · `GET /runs/{dataset}/{runId}` → full run JSON.

## Activate on this EC2 box (mirrors `minifin_query`)

```bash
cd /data/zeroshotbio-landingpage/backend/daniotype_autopilot_api
/data/.venv/bin/pip install -r requirements.txt          # already present

# 1. set a long random token, install + start the service
sudo cp daniotype_autopilot.service /etc/systemd/system/
sudoedit /etc/systemd/system/daniotype_autopilot.service  # set AUTOPILOT_API_TOKEN
sudo systemctl daemon-reload && sudo systemctl enable --now daniotype_autopilot
curl -s 127.0.0.1:5008/health                              # {"ok":true,...}

# 2. expose via nginx (add the snippet to the zscape.zeroshot.bio server block)
#    -> serves the worker at https://zscape.zeroshot.bio/autopilot/
sudo nano /etc/nginx/conf.d/zscape_chat.conf               # paste nginx-snippet.conf
sudo nginx -t && sudo systemctl reload nginx
```

## Wire to the app (Vercel env, Production)

```
KASPEROV_AUTOPILOT_URL=https://zscape.zeroshot.bio/autopilot
KASPEROV_AUTOPILOT_TOKEN=<same token as AUTOPILOT_API_TOKEN>
```

That's it — **both** "Load Previous Run" (the run store) and the
☁ "Run AutoPilot on server" button read these two env vars. No AWS / S3 setup.
When unset, both degrade gracefully (the modal + button say "not configured");
exported runs still download locally and re-load via **Import results**.

## Notes

- The worker needs **no** OpenAI or AWS keys — only HTTPS to the deployed app.
- Orchestration mirrors the client's `runOneCluster` (two independent Researcher
  proposers → Reasoner reconciles → cite-discipline → conclude), then batch
  ground-truth scoring. The Reasoner→specialist *dispatch* sub-loop is omitted
  server-side for simplicity; everything else matches.
- Auto-pilot status is in-memory (per process); a completed run is durable
  because it's written to the EBS volume.

## Timelapse GIF capture (`capture_gif.py`)

`POST /capture {datasetId, model}` → `{captureId, outDir, gif}` · `GET /capture/{id}` → progress.

The headless API loop has no UI, so to FILM a run the worker spawns a headless
Chromium (Playwright) that drives the wizard's **capture mode**
(`/daniotype_kasperov?capture=1&dataset=<id>&model=<m>`) — which auto-runs the
in-browser AutoPilot and saves the run when done. It screenshots every ~10s into
`$AUTOPILOT_RUNS_DIR/gifs/<id>/frames/` and squeezes them into one ~60s
`timelapse.gif` (Pillow). In the UI this is the "record a GIF" option on the
**☁ Run AutoPilot on server** button; the capture run replaces the API-loop run
(it both films and saves), so the AutoPilot only executes once.

One-time setup on the box (same `ssm-user` the worker runs as):

```bash
/data/.venv/bin/pip install playwright Pillow
/data/.venv/bin/python -m playwright install chromium   # browser → ~/.cache/ms-playwright
```

`CAPTURE_PYTHON` (default `/data/.venv/bin/python`) selects the interpreter. The
GIF lands at `$AUTOPILOT_RUNS_DIR/gifs/<captureId>/timelapse.gif` — grab it off
the EBS volume directly.
