# Zeroshot Bio — Web App

*Next.js 14 · Tailwind CSS · Flask · Jina Ridge · Claude Sonnet 4.6 · Vercel*

---

## What's in this repo

| Route | What it is | Stack |
|---|---|---|
| `/` | Marketing landing page | Next.js + Tailwind |
| `/zscape_chat` | ZSCAPE perturbation chat | Next.js front-end → Flask backend |

The main product is **ZSCAPE chat** — a single-page chat interface for querying the effects of zebrafish gene knockouts across 10 developmental phenotype categories.

---

## ZSCAPE chat

**Two query modes:**

- **Known KO lookup** — 25 experimentally verified knockouts with ground-truth influence scores (GT v3.2). Returns scores, LOKO Pearson validation, and a Claude-generated interpretation.
- **Novel gene prediction** — any gene not in the ground-truth set. Embeds a description of the gene using `jinaai/jina-embeddings-v3`, runs a pre-trained Ridge regression across 151 zebrafish cell types, and streams results through Claude for narrative.

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
│   ├── page.tsx                  landing page
│   ├── layout.tsx
│   ├── globals.css               shared CSS (Roboto Slab, custom utilities)
│   ├── zscape_chat/
│   │   └── page.tsx              ZSCAPE chat UI (React, all CSS inlined)
│   └── api/
│       ├── visitors/             DynamoDB visit logger
│       ├── orthologs/            gene ortholog lookup
│       └── alliance_full/        Alliance genome data proxy
├── backend/
│   └── zscape_chat_api/
│       ├── app.py                Flask SSE backend
│       └── requirements.txt
├── public/
│   └── images/
├── tailwind.config.ts
└── next.config.js
```

---

## Running locally

**Front-end:**
```bash
npm install
npm run dev          # http://localhost:3000
```

**Backend (Flask):**
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

On first novel-gene request it lazy-loads `jina-embeddings-v3` (~200 MB, cached to `~/.cache/huggingface/`).

Data files are read from `ZSCAPE_V4_ROOT` (default: `/data/ZSCAPE_complements_v4`).

---

## Infrastructure

- **Vercel** — hosts the Next.js front-end; deploys automatically on push to `main`
- **EC2** — hosts the Flask backend behind Nginx + SSL

Environment variables needed in Vercel:
```
ANTHROPIC_API_KEY
AWS_REGION
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
```
