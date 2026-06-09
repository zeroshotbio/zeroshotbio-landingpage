# daniotype_kasperov persistent auto-pilot worker

Runs the **AutoPilot Cluster Labeller server-side** so a run survives the
browser closing / the laptop sleeping. It drives the *same* labelling loop the
client does, but headlessly — for each cluster it calls the **deployed Vercel
endpoints** (`/api/kasperov_agent`, `/api/kasperov_score`), so all secrets
(OpenAI, AWS) stay on Vercel; this box holds none. When the run finishes it
POSTs the combined run JSON to `/api/kasperov_runs`, which lands it in
**Load Previous Run** (tagged `☁ server`).

## Endpoints (token-gated, `x-api-token`)

- `POST /start` `{datasetId, model, baseUrl?}` → `{runId}` (spawns a background thread)
- `GET  /status/{runId}` → `{phase, done, total, current, cost, runSaved, ...}`
- `POST /abort/{runId}`
- `GET  /health`

`phase`: `queued → loading → labelling → scoring → saving → done` (or `error`/`aborted`).

## Activate on this EC2 box (mirrors `minifin_query`)

```bash
cd /data/zeroshotbio-landingpage/backend/daniotype_autopilot_api
/data/.venv/bin/pip install -r requirements.txt          # fastapi/uvicorn/requests (already present)

# 1. set a long random token in the unit, then install it
sudo cp daniotype_autopilot.service /etc/systemd/system/
sudoedit /etc/systemd/system/daniotype_autopilot.service  # set AUTOPILOT_API_TOKEN
sudo systemctl daemon-reload && sudo systemctl enable --now daniotype_autopilot
curl -s 127.0.0.1:5008/health                              # {"ok":true,...}

# 2. expose via nginx (add the snippet to the zscape.zeroshot.bio server block)
#    -> serves the worker at https://zscape.zeroshot.bio/autopilot/
sudo nano /etc/nginx/conf.d/zscape_chat.conf               # paste nginx-snippet.conf's location block
sudo nginx -t && sudo systemctl reload nginx
```

## Wire to the app (Vercel env, Production)

```
KASPEROV_AUTOPILOT_URL=https://zscape.zeroshot.bio/autopilot
KASPEROV_AUTOPILOT_TOKEN=<same token as AUTOPILOT_API_TOKEN>
KASPEROV_RUNS_BUCKET=<your S3 bucket>          # also needed so the worker's save lands
```

When `KASPEROV_AUTOPILOT_URL` is unset, the in-app **☁ Run AutoPilot on server**
button degrades gracefully (shows "server runner not configured"). When
`KASPEROV_RUNS_BUCKET` is unset, the worker still labels + scores but the final
save returns not-configured.

## Notes

- The worker needs **no** OpenAI or AWS keys — it only makes HTTPS calls to the
  deployed app. Cost is incurred on Vercel's OpenAI key, same as a browser run.
- Orchestration mirrors the client's `runOneCluster` (two independent Researcher
  proposers → Reasoner reconciles → cite-discipline → conclude), then batch
  ground-truth scoring. The Reasoner→Researcher/Archivist *dispatch* sub-loop is
  intentionally omitted server-side for simplicity; everything else matches.
- Status is in-memory (per process); a completed run is durable because it's
  saved to S3 + DynamoDB via `/api/kasperov_runs`.
