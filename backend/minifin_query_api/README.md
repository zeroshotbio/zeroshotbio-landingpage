# MiniFin query microservice

The heavy-compute backend for the **daniotype_kasperov Archivist**. It loads the
MiniFin h5ad once and answers the queries the precomputed static matrices can't:

- `pvalues` — one-vs-rest Welch t-test on log-normalised expression, **BH-adjusted
  across the transcriptome**, for a list of genes in a cluster.
- `coexpress` — **cell-level** fraction of a cluster's cells co-expressing ALL of
  a gene set simultaneously.

The Archivist tool (`/api/kasperov_agent`) calls `POST /query` only when
`MINIFIN_SERVICE_URL` is set in the Vercel project; otherwise those two query
kinds degrade gracefully (everything else — gene stats, top-N, search, across,
specificity — is served from the static matrices and needs no service).

## API

```
GET  /health                         → {ok, loaded, cells, clusters}
POST /query   (header x-api-token)    → results
     body: {"kind":"pvalues"|"coexpress", "cluster":"5", "genes":["hbe1","hemgn"]}
```

It loads ~94.6k cells × ~32.5k genes (~30s startup, ~6 GB RAM), binds
`127.0.0.1:5007`, and requires `x-api-token: $MINIFIN_API_TOKEN` on `/query`.

## Run it (on the EC2 box)

```bash
cd /data/zeroshotbio-landingpage/backend/minifin_query_api
/data/.venv/bin/pip install -r requirements.txt          # fastapi, uvicorn, anndata, scipy, numpy

# quick manual test
MINIFIN_API_TOKEN=devtoken /data/.venv/bin/uvicorn app:app --host 127.0.0.1 --port 5007
curl -s localhost:5007/health
```

### As a systemd service

```bash
# 1) edit the token in the unit (must match the Vercel env var you set below)
sudoedit /data/zeroshotbio-landingpage/backend/minifin_query_api/minifin_query.service   # set MINIFIN_API_TOKEN
sudo cp /data/zeroshotbio-landingpage/backend/minifin_query_api/minifin_query.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now minifin_query
sudo systemctl status minifin_query
curl -s localhost:5007/health
```

## Expose it to Vercel

The Vercel function must reach the service over HTTPS. Proxy it behind a public
host you already serve (e.g. the zscape nginx), keeping it on a path:

```nginx
# inside the server block for a public host (e.g. zscape.zeroshot.bio)
location /minifin/ {
    proxy_pass http://127.0.0.1:5007/;   # trailing slash strips the /minifin prefix
    proxy_read_timeout 60s;
}
```

Then in the **Vercel project env** (Production), set and redeploy:

```
MINIFIN_SERVICE_URL   = https://zscape.zeroshot.bio/minifin
MINIFIN_SERVICE_TOKEN = <the same value as MINIFIN_API_TOKEN>
```

That's it — the Archivist's `pvalues` / `coexpress` kinds will start hitting the
live service. (The token is checked by the service; nginx just proxies.)

## Extending

Add new query kinds in `app.py` (`/query` handler) and a matching `kind` in the
Archivist tool schema in `src/app/api/kasperov_agent/route.ts`. The in-memory
matrices (`norm`, `xlog`, `xlog2`, `B`) support fast per-cluster and cell-level
computations; per-cluster t-test results are cached.
